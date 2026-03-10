import client from './client';

export async function listMembers(includeInactive = false) {
  const { data } = await client.get('/cabinet-members/', {
    params: { include_inactive: includeInactive },
  });
  return data; // { items: [...], total: number }
}

export async function inviteMember(payload) {
  const { data } = await client.post('/cabinet-members/invite', payload);
  return data; // CabinetMemberResponse
}

export async function updateMember(id, payload) {
  const { data } = await client.patch(`/cabinet-members/${id}`, payload);
  return data; // CabinetMemberResponse
}
