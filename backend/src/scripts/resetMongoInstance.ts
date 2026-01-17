import 'dotenv/config';
import { MikroORM } from '@mikro-orm/core';
import config from '../mikro-orm.config';
import { DatabaseInstance } from '../entities/DatabaseInstance';

async function resetMongoInstance() {
    console.log('🚀 Initializing MikroORM...');
    const orm = await MikroORM.init(config);
    const em = orm.em.fork();

    try {
        console.log('🔄 resetting mongo-zluri-1 instance...');

        const instance = await em.findOne(DatabaseInstance, { id: 'mongo-zluri-1' });

        if (instance) {
            instance.host = 'localhost';
            instance.port = 27017;
            instance.credentialsEnvPrefix = 'MONGO_INSTANCE_1';
            // Clear any connection string env override to force using the prefix constructed one OR the one in proper env var
            instance.connectionStringEnv = undefined;
            instance.isActive = true;

            await em.flush();
            console.log('✅ Successfully reset mongo-zluri-1 to localhost:27017');
            console.log('📝 NOTE: Ensure .env has MONGO_INSTANCE_1_CONNECTION_STRING=mongodb://localhost:27017');
        } else {
            console.error('❌ Instance mongo-zluri-1 not found!');
        }

    } catch (error) {
        console.error('❌ Failed to reset instance:', error);
    } finally {
        await orm.close();
    }
}

resetMongoInstance();
