const axios = require("axios");

async function tagQuestion(questionText){

 const prompt = `
Analyze this SSC exam question and return tags.

Question:
${questionText}

Return JSON only.

{
 subject:"",
 chapter:"",
 concept:"",
 difficulty:"",
 trap_type:"",
 formula:""
}
`

 const response = await axios.post(
  "https://api.openai.com/v1/chat/completions",
  {
   model: "gpt-4o-mini",
   messages: [{ role: "user", content: prompt }]
  },
  {
   headers:{
    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
   }
  }
 )

 const result = response.data.choices[0].message.content
 return JSON.parse(result)
}

module.exports = tagQuestion