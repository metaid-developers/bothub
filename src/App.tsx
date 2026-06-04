import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { BotHubPage } from '@/routes/BotHub'
import { BotListPage } from '@/routes/BotList'
import { DeliveryPage } from '@/routes/Delivery'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<BotHubPage />} />
        <Route path="/bot" element={<BotListPage />} />
        <Route path="/delivery" element={<DeliveryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
