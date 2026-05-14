const mongoose = require('mongoose');

const uri = "mongodb+srv://naitikraiyani88_db_user:Naitik.41105@cluster0.sqhwx7u.mongodb.net/bgremover?retryWrites=true&w=majority";

mongoose.connect(uri, {
  serverSelectionTimeoutMS: 5000,
  family: 4
})
.then(() => {
  console.log("Connected successfully!");
  process.exit(0);
})
.catch(err => {
  console.error("Connection error:", err);
  process.exit(1);
});
