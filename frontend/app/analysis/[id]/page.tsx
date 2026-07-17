"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getAnalysis } from "@/lib/api";
import { ResultPanel } from "@/components/dashboard/result-panel";
import type { AnalysisData, ApiError } from "@/types";

export default function AnalysisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, getToken } = useAuth();
  const [result, setResult] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const id = params?.id as string;
    if (!id) return;

    getToken()
      .then((token) => (token ? getAnalysis(token, id) : null))
      .then((res) => {
        if (!res) return;
        if ("error" in res) {
          setError(res.error);
        } else {
          setResult(res.data);
        }
      })
      .finally(() => setLoading(false));
  }, [authLoading, user, params, router, getToken]);

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <button
          type="button"
          onClick={() => router.push("/history")}
          className="btn-ghost"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回历史
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ResultPanel result={result} loading={false} error={error} />
        )}
      </div>
    </div>
  );
}
