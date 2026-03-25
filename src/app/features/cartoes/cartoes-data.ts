const G =
  'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

export interface CartaoDados {
  bgRect: string;
  mapPng?: string;
  ellipseDecor?: string;
  ellipse655?: string;
  unionDecor?: string;
  mcGroup?: string;
  holderLabel: string;
  panDisplay: string;
  panCopy: string;
  expiry: string;
  cvv: string;
  balanceFormatted: string;
}

export const CARTOES_MOCK: CartaoDados[] = [
  {
    bgRect: `${G}/Rectangle2-d0f8b206-38a3-492b-ac6b-4965ddb0223a.svg`,
    mapPng: `${G}%2Fe3515cb9-6cc5-45ea-9365-69859091bdeb.png`,
    ellipseDecor: `${G}/Ellipse1-ac5c7033-3e1b-4f4f-8677-c7bfb981b36d.svg`,
    ellipse655: `${G}/Ellipse655-cafa124e-7ec9-4a06-bccc-6036461952be.svg`,
    unionDecor: `${G}/Union-0a2ddc5c-4f05-4559-8af8-9b0b9fe9edf2.svg`,
    mcGroup: `${G}/Group2-ea92af74-768f-48f6-a6e6-39526f5fb27c.svg`,
    holderLabel: 'SERVIDOR CLOUD',
    panDisplay: '3782 8224 6310 1029',
    panCopy: '3782822463101029',
    expiry: '08/28',
    cvv: '214',
    balanceFormatted: 'R$ 12.400,00',
  },
  {
    bgRect: `${G}/Rectangle2-19335240-2f56-4f9c-b3d3-8d695efab1a7.svg`,
    ellipseDecor: `${G}/Ellipse1-ac5c7033-3e1b-4f4f-8677-c7bfb981b36d.svg`,
    ellipse655: `${G}/Ellipse655-cafa124e-7ec9-4a06-bccc-6036461952be.svg`,
    unionDecor: `${G}/Union-0a2ddc5c-4f05-4559-8af8-9b0b9fe9edf2.svg`,
    mcGroup: `${G}/Group2-ea92af74-768f-48f6-a6e6-39526f5fb27c.svg`,
    holderLabel: 'ADMSPOT FINANCE',
    panDisplay: '4562 1122 4595 7852',
    panCopy: '4562112245957852',
    expiry: '12/39',
    cvv: '698',
    balanceFormatted: 'R$ 50.000,00',
  },
  {
    bgRect: `${G}/Rectangle2-95077f83-0a08-4bb7-9b4b-8fd78df75696.svg`,
    mapPng: `${G}%2F1cdca65e-6a4e-49b8-95d6-13336e860783.png`,
    ellipseDecor: `${G}/Ellipse1-ac5c7033-3e1b-4f4f-8677-c7bfb981b36d.svg`,
    ellipse655: `${G}/Ellipse655-cafa124e-7ec9-4a06-bccc-6036461952be.svg`,
    unionDecor: `${G}/Union-0a2ddc5c-4f05-4559-8af8-9b0b9fe9edf2.svg`,
    mcGroup: `${G}/Group2-ea92af74-768f-48f6-a6e6-39526f5fb27c.svg`,
    holderLabel: 'META ADS',
    panDisplay: '5555 5555 5555 8831',
    panCopy: '5555555555558831',
    expiry: '03/27',
    cvv: '042',
    balanceFormatted: 'R$ 8.200,00',
  },
];
