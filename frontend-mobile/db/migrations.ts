import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'appointments',
          columns: [{ name: 'care_details', type: 'string', isOptional: true }],
        }),
      ],
    },
  ],
});
