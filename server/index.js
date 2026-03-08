require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Contacts Manager running at http://localhost:${PORT}`);
});
