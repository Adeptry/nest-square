import {
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import pRetry from "p-retry";
import {
  ApiError,
  ApiResponse,
  CatalogObject,
  Client,
  CreateCatalogImageResponse,
  Environment,
  FileWrapper,
  ObtainTokenResponse,
} from "square";
import { Readable } from "stream";
import { NestSquareCatalogObjectTypeEnum } from "./nest-square-catalog-object-type.enum.js";
import { NestSquareFile } from "./nest-square-file.js";
import type { NestSquareConfigType } from "./nest-square.config.js";

@Injectable()
export class NestSquareService {
  private readonly logger = new Logger(NestSquareService.name);

  constructor(
    @Inject("NEST_SQUARE_CONFIG")
    private config: NestSquareConfigType
  ) {
    this.logger.verbose(this.constructor.name);
  }

  /**
   * Creates and returns a new Square API client.
   *
   * @param {Object} [params] - Optional parameters for client creation.
   * @param {string} [params.accessToken] - The access token to use for authentication.
   * @returns {Client} The newly created Square API client.
   */
  client(params?: { accessToken?: string }): Client {
    this.logger.verbose(this.client.name);
    return new Client({
      accessToken: params?.accessToken,
      environment: this.config.clientEnvironment as Environment,
    });
  }

  /**
   * Retries the provided client function or throws an error if unsuccessful.
   *
   * @template T The type of the value returned by the client function.
   * @param {string} accessToken - The access token to use for authentication.
   * @param {(client: Client) => Promise<T>} clientFn - A function that takes a Square API client and returns a promise.
   * @returns {Promise<T>} A promise that resolves to the value returned by the client function or rejects if unsuccessful.
   */
  retryOrThrow<T>(
    accessToken: string,
    clientFn: (client: Client) => Promise<T>
  ): Promise<T> {
    this.logger.verbose(this.retryOrThrow.name);
    return this.pRetryOrThrow(() =>
      clientFn(this.client({ accessToken: accessToken }))
    );
  }

  /**
   * Retries obtaining an OAuth token or throws an error if unsuccessful.
   *
   * @param {object} params - The parameters needed to obtain a token.
   * @param {string} params.code - The authorization code to use for obtaining a token.
   * @returns {Promise} A promise that resolves to the obtained token or rejects if unsuccessful.
   */
  retryObtainTokenOrThrow(params: {
    code: string;
  }): Promise<ApiResponse<ObtainTokenResponse>> {
    const { code } = params;
    this.logger.verbose(this.retryObtainTokenOrThrow.name);
    return this.pRetryOrThrow(() =>
      this.client().oAuthApi.obtainToken({
        clientId: this.config.oauthClientId,
        clientSecret: this.config.oauthClientSecret,
        grantType: "authorization_code",
        code,
      })
    );
  }

  /**
   * Retries refreshing an OAuth token or throws an error if unsuccessful.
   *
   * @param {object} params - The parameters needed to refresh a token.
   * @param {string} params.refreshToken - The refresh token to use for obtaining a new access token.
   * @returns {Promise} A promise that resolves to the refreshed token or rejects if unsuccessful.
   */
  async retryRefreshTokenOrThrow(params: {
    refreshToken: string;
  }): Promise<ApiResponse<ObtainTokenResponse>> {
    const { refreshToken } = params;
    this.logger.verbose(this.retryRefreshTokenOrThrow.name);
    return this.pRetryOrThrow(() =>
      this.client().oAuthApi.obtainToken({
        clientId: this.config.oauthClientId,
        clientSecret: this.config.oauthClientSecret,
        grantType: "refresh_token",
        refreshToken,
      })
    );
  }

  private async pRetryOrThrow<T>(fn: () => Promise<T>): Promise<T> {
    this.logger.verbose(this.pRetryOrThrow.name);
    return pRetry(fn, {
      onFailedAttempt: (error) => {
        if (error instanceof ApiError) {
          const isRetryable =
            error.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR ||
            error.statusCode === HttpStatus.TOO_MANY_REQUESTS;

          if (!isRetryable || error.retriesLeft === 0) {
            this.logger.error(this.pRetryOrThrow.name, error);
            throw new InternalServerErrorException(error);
          }
        } else {
          throw error;
        }
      },
    });
  }

  /**
   * Accumulates catalog objects of specified types, handling pagination automatically.
   *
   * @param {object} params - The parameters for accumulating the catalog.
   * @param {string} params.accessToken - The access token to use for API calls.
   * @param {NestSquareCatalogObjectTypeEnum[]} params.types - An array of catalog object types to accumulate.
   * @returns {Promise<CatalogObject[]>} A promise that resolves to an array of accumulated catalog objects.
   */
  async accumulateCatalogOrThrow(params: {
    accessToken: string;
    types: NestSquareCatalogObjectTypeEnum[];
  }): Promise<CatalogObject[]> {
    this.logger.verbose(this.accumulateCatalogOrThrow.name);
    const { accessToken, types } = params;
    const client = this.client({ accessToken });
    const catalogObjects: CatalogObject[] = [];
    const theTypes = types.join(",");

    let listCatalogResponse = await this.pRetryOrThrow(() =>
      client.catalogApi.listCatalog(undefined, theTypes)
    );
    catalogObjects.push(...(listCatalogResponse?.result.objects ?? []));

    let cursor = listCatalogResponse?.result.cursor;
    while (cursor !== undefined) {
      listCatalogResponse = await this.pRetryOrThrow(() =>
        client.catalogApi.listCatalog(cursor, theTypes)
      );
      cursor = listCatalogResponse?.result.cursor;
      catalogObjects.push(...(listCatalogResponse?.result.objects ?? []));
    }

    return catalogObjects;
  }

  /**
   * Uploads an image to the Square catalog, associating it with an optional object ID.
   *
   * @param {object} params - The parameters for uploading the image.
   * @param {string} params.accessToken - The access token for Square API.
   * @param {string} params.idempotencyKey - A unique key to ensure idempotent operation.
   * @param {string} params.id - An identifier for the image to be uploaded.
   * @param {string} [params.objectId] - The optional object ID to associate the image with.
   * @param {NestSquareFile} params.file - The file to be uploaded.
   * @param {string} [params.caption] - Optional caption for the image.
   * @returns {Promise<CreateCatalogImageResponse>} A promise that resolves to the API response for the operation.
   */
  async uploadCatalogImageOrThrow(params: {
    accessToken: string;
    idempotencyKey: string;
    id: string;
    objectId?: string;
    file: NestSquareFile;
    caption?: string;
  }): Promise<CreateCatalogImageResponse> {
    this.logger.verbose(this.uploadCatalogImageOrThrow.name);
    const { idempotencyKey, objectId, file, caption, id } = params;
    const bufferToStream = (buffer: Buffer) => {
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);
      return stream;
    };

    const fileStream = bufferToStream(file.buffer);
    const fileWrapper = new FileWrapper(fileStream, {
      contentType: file.mimetype,
    });
    const response = await this.pRetryOrThrow(() =>
      this.client({
        accessToken: params.accessToken,
      }).catalogApi.createCatalogImage(
        {
          idempotencyKey: idempotencyKey,
          objectId: objectId,
          image: {
            type: "IMAGE",
            id: `#${id}`,
            imageData: {
              caption: caption,
            },
          },
        },
        fileWrapper
      )
    );

    return response.result;
  }
}
