export type ClassroomUpdate = { id: string; title: string; body: string; createdAt: string };
export type LiveClassLink = { url: string | null; isActive: boolean };

type ClassroomUpdateRow = { id: string; title: string; body: string; created_at: string };
export function mapClassroomUpdateRow(row: ClassroomUpdateRow): ClassroomUpdate {
  return { id: row.id, title: row.title, body: row.body, createdAt: row.created_at };
}

type LiveClassRow = { url: string | null; is_active: boolean };
export function mapLiveClassRow(row: LiveClassRow): LiveClassLink {
  return { url: row.url, isActive: row.is_active };
}
