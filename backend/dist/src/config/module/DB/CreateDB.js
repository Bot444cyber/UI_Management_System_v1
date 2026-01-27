"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
function CreateDB(dbName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!/^[a-zA-Z0-9_-]+$/.test(dbName)) {
            throw new Error(`Invalid database name: ${dbName}. Only alphanumeric characters, underscores, and dashes are allowed.`);
        }
        // Connect to PostgreSQL server (connect to default 'postgres' database)
        const client = new pg_1.Client({
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: 'postgres', // Connect to default database to create new one
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5432'),
        });
        try {
            yield client.connect();
            // Check if database exists
            const res = yield client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
            if (res.rowCount === 0) {
                // Create the database
                // Note: CREATE DATABASE cannot run locally in a transaction block, 
                // so we're safe here as we're just running a direct query
                yield client.query(`CREATE DATABASE "${dbName}"`);
                console.log(`✅ Database "${dbName}" created successfully.`);
            }
            else {
                console.log(`ℹ️ Database "${dbName}" already exists.`);
            }
        }
        catch (error) {
            console.error(`❌ Error creating database "${dbName}":`, error);
            throw error;
        }
        finally {
            yield client.end();
        }
    });
}
exports.default = CreateDB;
