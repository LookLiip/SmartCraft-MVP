import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ReportState {
  currentReportId: string | null
  setCurrentReportId: (id: string | null) => void
}

export const useReportStore = create<ReportState>()(
  persist(
    (set) => ({
      currentReportId: null,
      setCurrentReportId: (id) => set({ currentReportId: id }),
    }),
    { name: 'smartcraft-report-storage' }
  )
)