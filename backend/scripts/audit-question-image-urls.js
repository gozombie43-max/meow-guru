import "dotenv/config";
import { MongoClient } from "mongodb";

async function run() {
  const client = new MongoClient(
    process.env.MONGODB_URI
  );

  try {
    await client.connect();

    const questions = client
      .db("quizDB")
      .collection("questions");

    const docs = await questions
      .find(
        {
          questionImage: {
            $type: "string",
            $ne: "",
          },
        },
        {
          projection: {
            _id: 0,
            id: 1,
            topic: 1,
            questionType: 1,
            questionImage: 1,
            questionImageKey: 1,
          },
        }
      )
      .toArray();

    const groups = {
      azureAbsolute: [],
      legacyRelative: [],
      b2Stable: [],
      other: [],
    };

    for (const doc of docs) {
      const url = String(
        doc.questionImage || ""
      );

      if (
        /^https:\/\/[^/]+\.blob\.core\.windows\.net\/questions\//i.test(
          url
        )
      ) {
        groups.azureAbsolute.push(doc);
      } else if (
        url.startsWith("/questions/")
      ) {
        groups.legacyRelative.push(doc);
      } else if (
        url.includes(
          "/api/upload/image/"
        )
      ) {
        groups.b2Stable.push(doc);
      } else {
        groups.other.push(doc);
      }
    }

    console.log("");
    console.log(
      "======================================"
    );
    console.log(
      "QUESTION IMAGE URL AUDIT"
    );
    console.log(
      "======================================"
    );

    console.log(
      `Total questionImage docs : ${docs.length}`
    );

    console.log(
      `Azure absolute URLs      : ${groups.azureAbsolute.length}`
    );

    console.log(
      `Legacy /questions/ URLs  : ${groups.legacyRelative.length}`
    );

    console.log(
      `B2 stable URLs           : ${groups.b2Stable.length}`
    );

    console.log(
      `Other URLs               : ${groups.other.length}`
    );

    console.log(
      "======================================"
    );

    for (const [
      name,
      values,
    ] of Object.entries(groups)) {
      if (!values.length) continue;

      console.log("");
      console.log(
        `--- ${name} samples ---`
      );

      console.log(
        JSON.stringify(
          values.slice(0, 5),
          null,
          2
        )
      );
    }
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});