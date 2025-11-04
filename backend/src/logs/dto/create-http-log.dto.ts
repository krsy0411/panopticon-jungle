export interface CreateHttpLogDto {
  timestamp?: string;
  request_id?: string | null;
  client_ip?: string | null;
  method?: string | null;
  path?: string | null;
  status_code?: string | number | null;
  request_time?: string | number | null;
  user_agent?: string | null;
  upstream_service?: string | null;
  upstream_status?: string | number | null;
  upstream_response_time?: string | number | null;
}
