
import 'dotenv/config';
import { MikroORM } from '@mikro-orm/core';
import config from '../mikro-orm.config';
import { User } from '../entities/User';
import { QueryRequest } from '../entities/QueryRequest';
import { getPodsByManager, getAllPods } from '../config/staticData';

async function debugData() {
    const orm = await MikroORM.init(config);
    const em = orm.em.fork();

    console.log('\n--- PODS (Static Config) ---');
    const allPods = getAllPods() as any[];
    allPods.forEach((p: any) => {
        console.log(`ID: ${p.id}, Name: ${p.name}, Manager: ${p.manager_email}`);
    });

    console.log('\n--- MANAGER DIAGNOSTICS ---');
    const users = await em.find(User, { role: 'manager' } as any);
    users.forEach(u => {
        console.log(`User: ${u.email} (ID: ${u.id})`);

        // Test with raw email
        const podsRaw = getPodsByManager(u.email);
        console.log(`   -> getPodsByManager('${u.email}'): [${podsRaw.map(p => p.id).join(', ')}]`);

        // Test with lowercase
        const emailLower = u.email.toLowerCase();
        const podsLower = getPodsByManager(emailLower);
        console.log(`   -> getPodsByManager('${emailLower}'): [${podsLower.map(p => p.id).join(', ')}]`);
    });

    await orm.close();
}

debugData().catch(err => console.error(err));
