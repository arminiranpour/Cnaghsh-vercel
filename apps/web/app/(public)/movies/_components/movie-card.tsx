/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";

import { buildResponsiveImageSrcSet } from "@/lib/media/responsive-images";
import styles from "../movies.module.css";

export type MovieCardItem = {
  id: string;
  titleFa: string;
  titleEn: string;
  director: string;
  posterCardPreviewUrl: string | null;
};

export function MovieCard({ movie }: { movie: MovieCardItem }) {
  return (
    <div className={styles.movieCard} dir="rtl">
      {movie.posterCardPreviewUrl ? (
        <img
          src={movie.posterCardPreviewUrl}
          srcSet={buildResponsiveImageSrcSet(movie.posterCardPreviewUrl)}
          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
          alt={movie.titleFa}
          className={styles.poster}
        />
      ) : (
        <div
          className={styles.poster}
          style={{ background: "#F2F2F2", display: "flex", alignItems: "center", justifyContent: "center", color: "#8A8A8A", fontSize: "10px" }}
        >
          بدون پوستر
        </div>
      )}
      <div className={styles.titleFa}>{movie.titleFa}</div>
      <div className={styles.titleEn}>{movie.titleEn}</div>
      <div className={styles.director}>کارگردان: {movie.director}</div>
      <Link href={`/movies/${movie.id}`} className={styles.detailsButton}>
        جزئیات فیلم
      </Link>
    </div>
  );
}
