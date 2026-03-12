/** Single secondhand listing or search link returned to the breakdown screen */
export interface SecondhandResult {
  title: string;
  price: number | null;
  platform: string;
  url: string;
}

export interface SecondhandResponse {
  results: SecondhandResult[];
}
