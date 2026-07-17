import type { Metadata } from "next";
import { headers } from "next/headers";

import { getBaseUrl } from "@/lib/seo/baseUrl";
import { buildMoviesHref, type MovieSearchParams } from "@/lib/url/buildMoviesHref";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { MovieFiltersResponsive } from "@/components/movies/MovieFiltersResponsive";

import { MoviesGrid } from "./_components/movies-grid";
import { MoviesSearchBar } from "./_components/movies-search-bar";
import styles from "./movies.module.css";
import countriesData from "../../../public/countries/countries.json";

export const revalidate = 60;

const PAGE_TITLE = "معرفی فیلم سی‌نقش";

type SearchParams = Record<string, string | string[] | undefined>;

type MovieListItem = {
  id: string;
  titleEn: string;
  titleFa: string;
  director: string;
  yearReleased: number;
  mediaType: "movie" | "series";
  country: string | null;
  ageRange: string;
  posterCardMediaAssetId: string;
  posterCardPreviewUrl: string | null;
  genres: Array<{ id: string; slug: string; nameEn: string; nameFa: string }>;
};

type MoviesResponse = {
  items: MovieListItem[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

type FiltersResponse = {
  genres: Array<{ id: string; slug: string; nameFa: string; nameEn: string }>;
  countries: string[];
  ageRanges: string[];
  yearMin: number;
  yearMax: number;
};

type CountryRecord = {
  name?: string;
  code?: string;
  name_fa?: string;
};

const countryOptions = Array.from(
  new Set(
    (countriesData as CountryRecord[])
      .map((item) => (item.name_fa ?? item.name ?? "").trim())
      .filter((value) => value.length > 0),
  ),
).sort((a, b) => a.localeCompare(b, "fa"));

const ageRangeOptions = [
  "G (General Audiences)",
  "PG (Parental Guidance)",
  "PG-13 (Parents Strongly Cautioned)",
  "R (Restricted)",
  "NC-17 (Adults Only)",
];

const parseParam = (params: SearchParams, key: string) => {
  const value = params[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const parseIntParam = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseCsv = (value?: string) => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: PAGE_TITLE,
  };
}

export default async function MoviesPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseParam(searchParams, "q")?.trim() ?? "";
  const mediaTypeParam = parseParam(searchParams, "mediaType")?.toLowerCase();
  const mediaType = mediaTypeParam === "movie" || mediaTypeParam === "series" ? mediaTypeParam : undefined;
  const yearFrom = parseIntParam(parseParam(searchParams, "yearFrom"));
  const yearTo = parseIntParam(parseParam(searchParams, "yearTo"));
  const country = parseParam(searchParams, "country")?.trim();
  const ageRange = parseParam(searchParams, "ageRange")?.trim();
  const genreIds = parseCsv(parseParam(searchParams, "genreIds"));
  const page = parseIntParam(parseParam(searchParams, "page")) ?? 1;

  const normalized: MovieSearchParams = {
    q: query || undefined,
    mediaType,
    yearFrom,
    yearTo,
    country: country || undefined,
    ageRange: ageRange || undefined,
    genreIds: genreIds.length ? genreIds : undefined,
    page,
  };

  const apiParams = new URLSearchParams();
  if (normalized.q) apiParams.set("q", normalized.q);
  if (normalized.mediaType) apiParams.set("mediaType", normalized.mediaType);
  if (typeof normalized.yearFrom === "number") apiParams.set("yearFrom", String(normalized.yearFrom));
  if (typeof normalized.yearTo === "number") apiParams.set("yearTo", String(normalized.yearTo));
  if (normalized.country) apiParams.set("country", normalized.country);
  if (normalized.ageRange) apiParams.set("ageRange", normalized.ageRange);
  if (normalized.genreIds && normalized.genreIds.length) {
    apiParams.set("genreIds", normalized.genreIds.join(","));
  }
  if (page > 1) apiParams.set("page", String(page));

  const baseUrl = getBaseUrl();
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const requestBaseUrl = host ? `${protocol}://${host}` : baseUrl;

  const moviesUrl = new URL("/api/movies", requestBaseUrl);
  moviesUrl.search = apiParams.toString();
  const filtersUrl = new URL("/api/movies/filters", requestBaseUrl);

  const [moviesRes, filtersRes] = await Promise.all([
    fetch(moviesUrl.toString(), { cache: "no-store" }),
    fetch(filtersUrl.toString(), { cache: "no-store" }),
  ]);

  let moviesData: MoviesResponse | null = null;
  let filtersData: FiltersResponse | null = null;

  if (moviesRes.ok) {
    try {
      moviesData = (await moviesRes.json()) as MoviesResponse;
    } catch (error) {
      console.error("Failed to parse movies response", error);
    }
  } else {
    console.error(`Movies API failed with ${moviesRes.status}`);
  }

  if (filtersRes.ok) {
    try {
      filtersData = (await filtersRes.json()) as FiltersResponse;
    } catch (error) {
      console.error("Failed to parse movie filters response", error);
    }
  } else {
    console.error(`Movies filters API failed with ${filtersRes.status}`);
  }

  if (!moviesData) {
    moviesData = {
      items: [],
      page,
      pageSize: 9,
      total: 0,
      pageCount: 1,
    };
  }

  if (!filtersData) {
    const currentYear = new Date().getFullYear();
    filtersData = {
      genres: [],
      countries: [],
      ageRanges: [],
      yearMin: 1888,
      yearMax: currentYear,
    };
  }

  const genreOptions =
    filtersData.genres.length > 0
      ? filtersData.genres
      : await prisma.genre.findMany({
          select: { id: true, slug: true, nameFa: true, nameEn: true },
          orderBy: { nameFa: "asc" },
        });

  const currentPage = moviesData.page ?? page;
  const pageCount = moviesData.pageCount ?? 1;
  const hasNextPage = currentPage < pageCount;
  const hasPrevPage = currentPage > 1;

  const clearHref = buildMoviesHref(normalized, () => ({
    mediaType: undefined,
    yearFrom: undefined,
    yearTo: undefined,
    country: undefined,
    ageRange: undefined,
    genreIds: undefined,
    page: undefined,
  }));

  return (
    <div className="relative min-h-[100svh] w-full overflow-x-hidden" dir="rtl">
      <div
        className="fixed inset-0 -z-10 bg-[#E5E5E5] bg-cover bg-center bg-no-repeat"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-10">
        <div className="mb-6 mt-[120px] flex flex-col gap-4 md:flex-row md:items-center md:justify-between" dir="rtl">
          <header className="flex flex-col">
            <h1 className={styles.pageTitle}>معرفی فیلم سی‌نقش</h1>
          </header>
          <MoviesSearchBar initialQuery={normalized.q ?? ""} className="w-full md:w-[670px] lg:w-[755px]" />
        </div>

        <main className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <MovieFiltersResponsive
            genres={genreOptions}
            countries={countryOptions}
            ageRanges={ageRangeOptions}
            yearMin={filtersData.yearMin}
            yearMax={filtersData.yearMax}
            className="w-full xl:w-[371px] shrink-0"
          />

          <MoviesGrid
            movies={moviesData.items.map((item) => ({
              id: item.id,
              titleFa: item.titleFa,
              titleEn: item.titleEn,
              director: item.director,
              posterCardPreviewUrl: item.posterCardPreviewUrl,
            }))}
            normalized={normalized}
            currentPage={currentPage}
            pageCount={pageCount}
            hasNextPage={hasNextPage}
            hasPrevPage={hasPrevPage}
            clearHref={clearHref}
            className={cn("flex-1")}
          />
        </main>
      </div>
    </div>
  );
}
