import PrismaInstance from "../../PrismaInstance";

async function DisconnectDB() {
    try {
        await PrismaInstance.$disconnect();
        console.log('Database disconnected successfully!');
    }
    catch (error) {
        console.error('Disconnection error:', error);
    }
}

export default DisconnectDB;