import { ArrowRight, Library, Play, RefreshCw, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TopicTagChips } from '@/components/ui/topic-tag-chips';
import { useVideoRecommendations } from '@/features/library/hooks/useVideos';

function RecommendationSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-64 animate-pulse rounded-xl border border-border bg-card shadow-soft"
        />
      ))}
    </div>
  );
}

export function RecommendedVideosSection() {
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useVideoRecommendations(6);

  return (
    <section aria-labelledby="recommended-videos-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Personalized picks
          </p>
          <h2 id="recommended-videos-title" className="mt-1 text-xl font-extrabold">
            Recommended for you
          </h2>
        </div>
        {isFetching && !isLoading ? (
          <RefreshCw
            aria-label="Refreshing recommendations"
            className="h-4 w-4 animate-spin text-muted-foreground"
          />
        ) : null}
      </div>

      {isLoading ? (
        <RecommendationSkeleton />
      ) : isError ? (
        <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 text-center">
          <p className="text-sm font-semibold">Recommendations are unavailable</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold transition-colors hover:border-primary/30 hover:text-primary"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : !data?.items.length ? (
        <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 text-center">
          <Library className="h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">No new recommendations yet</p>
          <button
            type="button"
            onClick={() => navigate('/library')}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary-hover"
          >
            Browse catalog
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map(({ video, reason_code: reasonCode, reason_text: reasonText }) => (
            <article
              key={video.id}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/dictation/${video.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/dictation/${video.id}`);
                }
              }}
              className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="relative aspect-video overflow-hidden bg-muted">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Play className="h-7 w-7" />
                  </div>
                )}
                {video.level ? (
                  <span className="absolute right-2 top-2 rounded-md bg-background/90 px-2 py-1 text-xs font-extrabold shadow-sm backdrop-blur">
                    {video.level}
                  </span>
                ) : null}
              </div>

              <div className="p-4">
                <h3 className="line-clamp-2 min-h-10 text-sm font-extrabold leading-5">
                  {video.title}
                </h3>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {video.channel || 'Unknown channel'}
                </p>

                {video.topic_tags?.length ? (
                  <TopicTagChips
                    publicTags={video.topic_tags.slice(0, 3)}
                    className="mt-3 min-h-6"
                  />
                ) : (
                  <div className="mt-3 min-h-6" />
                )}

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span
                    data-reason-code={reasonCode}
                    className="min-w-0 truncate text-xs font-semibold text-primary"
                    title={reasonText}
                  >
                    {reasonText}
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/dictation/${video.id}`);
                    }}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Practice
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
