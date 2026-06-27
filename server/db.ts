import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../client/src/db/schema';

const connection = mysql.createPool({
  uri: process.env.DATABASE_URL!,
});

export const db = drizzle(connection, { schema, mode: 'default' });
