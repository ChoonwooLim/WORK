const { encrypt, decrypt } = require('./db/crypto');
const env_vars = { ANTHROPIC_API_KEY: "sk-ant-1234" };
const stringToDB = '"' + encrypt(JSON.stringify(env_vars)) + '"';
// pg parses JSONB. So JSON.parse(stringToDB) gives back a string.
const pgReturns = JSON.parse(stringToDB);
console.log('from DB typeof:', typeof pgReturns, pgReturns);
const decryptedStr = decrypt(pgReturns);
console.log('decrypted string:', decryptedStr);
const parsedObj = decryptedStr ? JSON.parse(decryptedStr) : {};
console.log('Final object:', parsedObj);
