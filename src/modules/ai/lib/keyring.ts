import { native } from "@/lib/native";

export type Provider = "openai" | "anthropic";

export const keyring = {
  get(provider: Provider) {
    return native.secrets.get(`${provider}:apikey`);
  },
  set(provider: Provider, value: string) {
    return native.secrets.set(`${provider}:apikey`, value);
  },
  remove(provider: Provider) {
    return native.secrets.delete(`${provider}:apikey`);
  },
};
