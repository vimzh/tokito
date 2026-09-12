import { notFound } from "next/navigation";
import { ApiError, getCall, type CallDetail as CallDetailData } from "@/lib/api";
import { CallDetail } from "@/components/campaigns/call-detail";

async function load(id: string, callId: string): Promise<CallDetailData> {
  try {
    return await getCall(id, callId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function CallPage({ params }: { params: Promise<{ id: string; callId: string }> }) {
  const { id, callId } = await params;
  return <CallDetail campaignId={id} call={await load(id, callId)} />;
}
