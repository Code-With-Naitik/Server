const mongoose = require('mongoose');

const URI_SRV = "mongodb+srv://naitikraiyani88_db_user:Naitik.41105@cluster0.sqhwx7u.mongodb.net/bgremover?retryWrites=true&w=majority";
const URI_STANDARD = "mongodb://naitikraiyani88_db_user:Naitik.41105@ac-yclv0wx-shard-00-00.sqhwx7u.mongodb.net:27017,ac-yclv0wx-shard-00-01.sqhwx7u.mongodb.net:27017,ac-yclv0wx-shard-00-02.sqhwx7u.mongodb.net:27017/bgremover?ssl=true&authSource=admin&retryWrites=true&w=majority";

async function testConnection(name, uri, options = {}) {
    console.log(`--- Testing ${name} ---`);
    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            ...options
        });
        console.log(`${name} SUCCESS!`);
        await mongoose.disconnect();
        return true;
    } catch (err) {
        console.log(`${name} FAILED: ${err.message}`);
        return false;
    }
}

async function run() {
    await testConnection("SRV Connection", URI_SRV, { family: 4 });
    await testConnection("Standard Connection", URI_STANDARD);
    process.exit(0);
}

run();
