import mimeFromBuffer from 'mime-tree';
import { MimeType, TransformOptions, UnsupportedImageError } from '../../types';
import { ImageError } from '../../types/error';
import type { AssetLoader } from '../../types/loader';
import { imageResponse, textResponse, redirectResponse } from '../../utils/response';
import { decodeQuery, decodeTransformQuery, parseURL } from '../../utils/url';
import { fetchResolver } from '../resolvers/fetchResolver';
import { pureTransformer } from '../transformers';
export const imageLoader: AssetLoader = async (
  {
    selfUrl,
    cache = null,
    resolver = fetchResolver,
    transformer = pureTransformer,
    useFallbackFormat = true,
    fallbackFormat,
    useFallbackTransformer = true,
    fallbackTransformer = pureTransformer,
    defaultOptions = {},
    redirectOnFail = false,
    skipFormats = new Set([MimeType.SVG]),
    basePath = 'public',
    whitelistedDomains = null,
    blacklistedDomains = null,
    verbose = false,
  },
  request,
) => {
  console.log(request.url);
  const reqUrl = parseURL(request.url);
  let src: string | null = null;

  try {
    if (!selfUrl) {
      throw new ImageError('selfUrl is required in RemixImage loader config!', 500);
    }

    let selfUrlObj;
    try {
      selfUrlObj = new URL(selfUrl);
    } catch (error) {
      throw new ImageError('selfUrl is not a valid URL!');
    }
    const whitelist = whitelistedDomains ? new Set([...whitelistedDomains, selfUrlObj.host]) : null;
    const blacklist = blacklistedDomains ? new Set(blacklistedDomains) : null;

    src = decodeQuery(reqUrl.searchParams, 'src');

    if (!src) {
      throw new ImageError('An image URL must be provided!', 400);
    }
    try {
      src = decodeURI(src);
    } catch (error) {
      throw new ImageError('An invalid image URL was provided!', 400);
    }

    const decodedQuery = decodeTransformQuery(reqUrl.search);
    const transformOptions: Required<TransformOptions> = {
      fit: 'cover',
      position: 'center',
      background: [0x00, 0x00, 0x00, 0x00],
      quality: 80,
      compressionLevel: 9,
      loop: 0,
      delay: 100,
      blurRadius: null,
      rotate: null,
      flip: null,
      crop: null,
      ...defaultOptions,
      ...decodedQuery,
    } as Required<TransformOptions>;

    const assetUrl = parseURL(src, selfUrl);

    if (!transformOptions.width) {
      throw new ImageError('A width is required!', 400);
    }
    if (transformOptions.width && transformOptions.width > 8000) {
      throw new ImageError('Requested Image too large!', 406);
    }
    if (transformOptions.height && transformOptions.height > 8000) {
      throw new ImageError('Requested Image too large!', 406);
    }

    const cacheKey = reqUrl.search;
    let isNewImage = true;
    let shouldTransform = true;
    let loadedImg: Uint8Array | undefined;
    let resultImg: Uint8Array | undefined;
    let inputContentType: MimeType | undefined;
    let outputContentType: MimeType | undefined = transformOptions.contentType;

    if (cache && (await cache.has(cacheKey))) {
      const cacheValue = await cache.get(cacheKey);

      if (cacheValue) {
        if (verbose) {
          console.log(`Retrieved image [${cacheKey}] from cache.`);
        }

        isNewImage = false;
        shouldTransform = false;

        loadedImg = cacheValue;
        inputContentType = mimeFromBuffer(loadedImg);
      }
    }

    if (!loadedImg) {
      if (whitelist && !whitelist.has(assetUrl.host)) {
        throw new ImageError('The requested image host is not included on the whitelist!');
      }
      if (blacklist && blacklist.has(assetUrl.host)) {
        throw new ImageError('The requested image host is not allowed!');
      }

      const res = await resolver(src, assetUrl.toString(), transformOptions, basePath);

      if (verbose) {
        console.log(`Fetched image [${cacheKey}] directly using resolver: ${resolver.name}.`);
      }

      isNewImage = true;
      shouldTransform = true;

      loadedImg = res.buffer;
      inputContentType = res.contentType;
    }

    if (!loadedImg || !inputContentType) {
      throw new ImageError('Failed to transform requested image!', 500);
    }

    if (!outputContentType) {
      outputContentType = inputContentType;
    }

    if (!shouldTransform || skipFormats?.has(inputContentType)) {
      resultImg = loadedImg;
    } else if (transformer != null) {
      let curTransformer = transformer;

      if (!transformer.supportedInputs.has(inputContentType)) {
        if (
          useFallbackTransformer &&
          transformer !== fallbackTransformer &&
          fallbackTransformer.supportedInputs.has(inputContentType)
        ) {
          console.error(
            `Transformer does not allow this input content type: ${inputContentType}! Falling back to transformer: ${fallbackTransformer.name}`,
          );
          curTransformer = fallbackTransformer;
        } else {
          throw new UnsupportedImageError(`Transformer does not allow this input content type: ${inputContentType}!`);
        }
      }

      if (!curTransformer.supportedOutputs.has(outputContentType)) {
        if (useFallbackFormat && fallbackFormat != null && curTransformer.supportedOutputs.has(fallbackFormat)) {
          console.error(
            `Transformer does not allow this output content type: ${outputContentType}! Falling back to mime type: ${fallbackFormat}`,
          );
          outputContentType = fallbackFormat;
        } else {
          console.error(
            `Transformer does not allow this output content type: ${outputContentType}! Falling back to mime type: ${curTransformer.fallbackOutput}`,
          );
          outputContentType = curTransformer.fallbackOutput;
        }
      }
      try {
        resultImg = await curTransformer.transform(
          {
            url: assetUrl.toString(),
            data: loadedImg,
            contentType: inputContentType!,
          },
          {
            ...transformOptions,
            contentType: outputContentType!,
          },
        );
      } catch (e) {
        throw new ImageError('The Curr Transformer Failed!', 500);
      }

      if (verbose) {
        console.log(`Successfully transformed image using transformer: ${curTransformer.name}`);
      }
    }

    if (!resultImg) {
      throw new ImageError('Failed to transform requested image!', 500);
    }

    if (isNewImage && cache) {
      await cache.set(cacheKey, resultImg);
    }

    return imageResponse(
      resultImg,
      200,
      outputContentType,
      cache
        ? `private, max-age=${cache.config.ttl}, max-stale=${cache.config.tbd}`
        : `public, max-age=${60 * 60 * 24 * 365}`,
    );
  } catch (error: unknown) {
    if (typeof process !== 'undefined' && process.env['NODE_ENV'] === 'test') {
      throw error;
    }
    if (error instanceof Error) {
      console.error('Image loader error:', error?.message, error?.stack);
    }
    console.error(error);

    if (redirectOnFail && src) {
      return redirectResponse(src);
    }

    if (error instanceof ImageError) {
      return textResponse(error.errorCode || 500, error.message);
    } else {
      return textResponse(500, 'RemixImage encountered an unknown error!');
    }
  }
};
