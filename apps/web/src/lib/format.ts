import { format } from "date-fns";

export const formatDate = (timestamp: number) => format(new Date(timestamp), "d MMM yyyy");
export const formatDateTime = (timestamp: number) => format(new Date(timestamp), "d MMM yyyy, HH:mm");

export const splitLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
