const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

const callOpenAI = async (messages, functions) => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: messages,
      functions: functions,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  return await response.json();
};

export default callOpenAI;
