import 'dotenv/config';

import {
  initUsersDB,
  initNotesDB,
  initAccessCodesDB,
  initMockAttemptsDB,
  initMockSlotsDB,
} from '../cosmos.js';

async function getCount(container, name) {
  try {
    const { resources } = await container.items
      .query('SELECT VALUE COUNT(1) FROM c')
      .fetchAll();

    return {
      name,
      count: resources?.[0] ?? 0,
    };
  } catch (error) {
    return {
      name,
      count: null,
      error: error.message,
    };
  }
}

async function run() {
  try {
    console.log('Connecting to remaining Cosmos containers...\n');

    const users = await initUsersDB();
    const notes = await initNotesDB();
    const accessCodes = await initAccessCodesDB();
    const mockAttempts = await initMockAttemptsDB();
    const mockSlots = await initMockSlotsDB();

    const results = await Promise.all([
      getCount(users, 'Users'),
      getCount(notes, 'Notes'),
      getCount(accessCodes, 'Access Codes'),
      getCount(mockAttempts, 'Mock Attempts'),
      getCount(mockSlots, 'Mock Slots'),
    ]);

    console.log('================================');
    console.log('COSMOS DATA COUNTS');
    console.log('================================');

    for (const result of results) {
      if (result.error) {
        console.log(
          `${result.name.padEnd(15)} : ERROR - ${result.error}`
        );
      } else {
        console.log(
          `${result.name.padEnd(15)} : ${result.count}`
        );
      }
    }

    console.log('================================');

  } catch (error) {
    console.error('❌ Check failed');
    console.error(error);
  }
}

run();