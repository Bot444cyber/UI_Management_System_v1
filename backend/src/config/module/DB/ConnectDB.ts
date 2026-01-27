import PrismaInstance from "../../PrismaInstance";

async function ConnectDB() {
  try {
    await PrismaInstance.$connect();
  }
  catch (error) {
    console.error('Connection error:', error);
    throw error;
  }
}

export default ConnectDB;