declare module "aws-msk-iam-sasl-signer-js" {
  export interface GenerateAuthTokenInput {
    region: string;
    hostname?: string;
    port?: number;
  }

  export interface GenerateAuthTokenOutput {
    token: string;
    expiration?: Date;
  }

  export function generateAuthToken(
    input: GenerateAuthTokenInput,
  ): Promise<GenerateAuthTokenOutput>;
}
