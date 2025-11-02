const res = await fetch('https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct', {
  headers: {
    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
    'Content-Type': 'application/json'
  },
  method: 'POST',
  body: JSON.stringify({
    inputs: `Edit this file content:\n${content}\n\nInstruction: ${instruction}`,
  })
});
