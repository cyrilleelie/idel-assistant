import client from './client';

export async function fetchMonthSchedule(year, month) {
  const { data } = await client.get('/schedule-assignments/', {
    params: { year, month },
  });
  return data; // ScheduleMonthResponse { year, month, schedule }
}

export async function toggleScheduleAssignment(nurseId, slotId, assignedDate) {
  const { data } = await client.post('/schedule-assignments/toggle', {
    nurse_id: nurseId,
    slot_id: slotId,
    assigned_date: assignedDate,
  });
  return data; // ScheduleToggleResponse { action, nurse_id, slot_id, assigned_date }
}
