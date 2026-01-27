
import { Client } from 'pg';

async function CreateDB(dbName: string) {
    if (!/^[a-zA-Z0-9_-]+$/.test(dbName)) {
        throw new Error(`Invalid database name: ${dbName}. Only alphanumeric characters, underscores, and dashes are allowed.`);
    }

    // Connect to PostgreSQL server (connect to default 'postgres' database)
    const client = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: 'postgres', // Connect to default database to create new one
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
    });

    try {
        await client.connect();
        
        // Check if database exists
        const res = await client.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`,
            [dbName]
        );

        if (res.rowCount === 0) {
            // Create the database
            // Note: CREATE DATABASE cannot run locally in a transaction block, 
            // so we're safe here as we're just running a direct query
            await client.query(`CREATE DATABASE "${dbName}"`);
            console.log(`✅ Database "${dbName}" created successfully.`);
        } else {
            console.log(`ℹ️ Database "${dbName}" already exists.`);
        }
    } catch (error: any) {
        console.error(`❌ Error creating database "${dbName}":`, error);
        throw error;
    } finally {
        await client.end();
    }
}

export default CreateDB;