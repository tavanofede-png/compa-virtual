export interface ClassroomProvider {
  authorize(
    accountId: string,
    redirectUri: string,
  ): Promise<{ url: string; state: string }>;
  exchangeCode(code: string, state: string): Promise<{ connectionId: string }>;
  listCourses(
    connectionId: string,
    cursor?: string,
  ): Promise<{
    courses: { externalId: string; name: string }[];
    cursor?: string;
  }>;
  syncCourse(
    connectionId: string,
    courseId: string,
    cursor?: string,
  ): Promise<{ items: ClassroomItem[]; cursor?: string }>;
  renewWatch(connectionId: string): Promise<{ expiresAt: string }>;
  disconnect(connectionId: string): Promise<void>;
}
export interface ClassroomItem {
  externalId: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: string | null;
  dueTime: string | null;
  updatedAt: string;
  url: string;
}
export interface VoiceProvider {
  transcribe(audio: Blob): Promise<string>;
  speak(text: string): Promise<Blob>;
}
export interface BillingProvider {
  entitlement(userId: string): Promise<{ fullAccess: boolean }>;
}
export interface EducationGroupProvider {
  groups(userId: string): Promise<{ id: string; name: string }[]>;
}
export const betaEntitlement: BillingProvider = {
  entitlement: async () => ({ fullAccess: true }),
};
