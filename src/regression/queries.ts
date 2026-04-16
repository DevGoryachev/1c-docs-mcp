export interface RegressionQuery {
  name: string;
  query: string;
  topic?: string;
}

export const REGRESSION_QUERIES: RegressionQuery[] = [
  {
    name: "http_error_contract",
    query: "http json content-type",
    topic: "http_api_rules"
  },
  {
    name: "client_server_calls",
    query: "серверный вызов",
    topic: "client_server_rules"
  },
  {
    name: "json_read_write",
    query: "json",
    topic: "json_patterns"
  },
  {
    name: "skd_parameters",
    query: "параметр",
    topic: "skd_core"
  },
  {
    name: "query_temp_tables",
    query: "временные таблицы",
    topic: "query_patterns"
  },
  {
    name: "rights_visibility",
    query: "интерфейс команды разделы",
    topic: "interface_rules"
  }
];
