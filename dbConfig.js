 
const sql = require("mssql");

const config = {
  user: "",
  password: "",
  server: "localhost",
  port: 1433,
  database: "",
  options: {
    encrypt: false,
  },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("Connected to MSSQL");
    return pool;
  })
  .catch((err) => {
    console.error("Database connection failed: ", err);
    process.exit(1);
  });

module.exports = {
  sql,
  poolPromise,
};
