export interface CreateAppLogDto {
  timestamp?: string;
  service: string;
  level: string;
  message: string;
}
