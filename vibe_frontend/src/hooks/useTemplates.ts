import { useQuery } from "@tanstack/react-query";
import { localTemplatesData, type Template } from "@/shared/templates";

export function useTemplates() {
  const query = useQuery({
    queryKey: ["templates"],
    queryFn: async (): Promise<Template[]> => {
      return Promise.resolve(localTemplatesData);
    },
    initialData: localTemplatesData,
    meta: {
      showErrorToast: false, // Don't show error toast for local data
    },
  });

  return {
    templates: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
