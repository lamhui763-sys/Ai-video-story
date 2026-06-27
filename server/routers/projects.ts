import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../db'; // Need to create this
import { projects } from '../../client/src/db/schema';

export const projectsRouter = router({
  list: publicProcedure.query(async () => {
    // For now, return empty or mock data until DB is fully wired
    return [];
  }),
  create: publicProcedure
    .input(z.object({ title: z.string(), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      // Mock creation for now
      return { id: 1, ...input };
    }),
});
