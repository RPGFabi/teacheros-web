import axios, { AxiosError, type AxiosAdapter, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

export interface FakeCall {
  method: string;
  url: string;
  authorization?: string;
  data?: unknown;
}

type Reply = { status?: number; data?: unknown } | ((call: FakeCall) => { status?: number; data?: unknown });

/**
 * Axios-Client mit scripted Antworten ("METHOD /pfad" -> Antwort) statt Netzwerk.
 * Nicht definierte Routen liefern 404. Status >= 400 wirft wie echtes Axios.
 */
export function fakeClient(routes: Record<string, Reply>): { client: AxiosInstance; calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const call: FakeCall = {
      method: (config.method ?? 'get').toUpperCase(),
      url: config.url ?? '',
      authorization: config.headers?.get?.('Authorization') as string | undefined,
      data: typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    };
    calls.push(call);
    const reply = routes[`${call.method} ${call.url}`];
    const { status = 200, data = {} } = typeof reply === 'function' ? reply(call) : (reply ?? { status: 404 });
    const response = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) {
      throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, null, response);
    }
    return response;
  };
  return { client: axios.create({ adapter }), calls };
}
