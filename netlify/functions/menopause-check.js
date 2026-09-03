const SYSTEM_PROMPT = `Du bist ein fachlich fundierter Assistent zum Thema Wechseljahre (Menopause).
Der Nutzer nennt sein Alter sowie eine Liste angekreuzter Symptome (aus einer vorgegebenen Liste, jeweils "ja" = trifft zu) plus ggf. zusätzliche, selbst genannte Symptome, die in den letzten 4 Wochen neu aufgetreten oder schlimmer geworden sind. Deine Aufgabe: schätze anhand dieser Angaben ein, mit welcher Wahrscheinlichkeit (in Prozent) sich die Nutzerin in welcher Phase befindet:
- Prämenopause (noch keine hormonelle Umstellung erkennbar, regelmäßiger Zyklus)
- Perimenopause (Übergangsphase, Zyklus wird unregelmäßig, erste Symptome nehmen zu)
- Postmenopause (seit 12+ Monaten keine Periode mehr, Symptome oft anders gelagert)

Die angekreuzten Symptome stammen bereits aus den anerkannten, international validierten Kategorien der Menopause Rating Scale (Hitzewallungen, Schlafprobleme, Reizbarkeit, gedrückte Stimmung, Ängstlichkeit, körperliche/geistige Erschöpfung, Gelenk-/Muskelbeschwerden, Herzbeschwerden, Blasenbeschwerden, Scheidentrockenheit, sexuelle Probleme). Beziehe zusätzlich genannte, selbst formulierte Symptome sinnvoll mit ein.

WICHTIG: Gib nur Phasen an, die anhand der Angaben tatsächlich plausibel sind. Wenn eine Phase klar nicht zutrifft (z.B. Postmenopause bei einer 35-Jährigen mit regelmäßigem Zyklus), lasse sie komplett weg – erfinde keinen Alibi-Prozentwert wie "3%" oder "5%" nur damit alle drei Phasen auftauchen. Das Array darf daher auch nur 1 oder 2 Objekte enthalten, wenn nur eine Phase wirklich relevant ist. Die Prozentwerte der tatsächlich aufgeführten, plausiblen Phasen sollen in Summe ungefähr 100% ergeben. Falls die geschilderten Symptome eher auf eine andere Ursache hindeuten (z.B. Stress, Schilddrüse), ergänze optional ein zusätzliches Objekt "Andere Ursache möglich" – in diesem Fall müssen die Prozentwerte nicht mehr exakt 100% ergeben.

Antworte AUSSCHLIESSLICH mit einem validen JSON-Array, ohne Markdown, ohne Backticks, ohne Fließtext davor oder danach. Jedes Objekt hat exakt diese Felder:
[
  {
    "phase": "Prämenopause | Perimenopause | Postmenopause | Andere Ursache möglich",
    "prozent": "Zahl mit %-Zeichen, z.B. '65%'",
    "begruendung": "2-3 Sätze, warum diese Einschätzung zu den geschilderten Angaben passt, sachlich und ohne Panikmache",
    "erkannte_symptome": ["Symptom1", "Symptom2"],
    "naechster_schritt": "Ein konkreter, praktischer nächster Schritt für die Nutzerin"
  }
]
Sortiere das Array absteigend nach Prozentwert (höchste Wahrscheinlichkeit zuerst). Sei fachlich präzise, vermeide Übertreibungen, vermeide "coachy" Sprache. Gib niemals eine endgültige Diagnose, sondern immer eine Einordnung der Wahrscheinlichkeit.`;

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "method_not_allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "invalid_json" }),
    };
  }

  const age = body.age || "nicht angegeben";
  const symptoms = Array.isArray(body.symptoms) ? body.symptoms : [];
  const extra = (body.extra || "").trim();

  const symptomList =
    symptoms.length > 0 ? symptoms.join(", ") : "keine der vorgegebenen Symptome angekreuzt";
  const userMessage =
    "Alter: " + age +
    "\nAngekreuzte Symptome der letzten 4 Wochen (neu oder verschlechtert): " + symptomList +
    (extra ? "\nWeitere, selbst genannte Symptome: " + extra : "");

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.Anthropic;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "missing_api_key", message: "ANTHROPIC_API_KEY ist nicht gesetzt." }),
    };
  }

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await anthropicRes.json().catch(function () { return null; });

    return {
      statusCode: anthropicRes.status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "network_error", message: String(e) }),
    };
  }
};
