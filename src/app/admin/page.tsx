"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { FullPageSpinner } from "@/components/Spinner";

export default function AdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/overview");
  }, [router]);

  return <FullPageSpinner message="Loading admin dashboard..." />;
}
