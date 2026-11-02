import { redirect } from 'next/navigation'

/** 报价都在各自项目的「报价」里，旧的报价列表地址跳到项目列表。 */
export default function QuotesPage() {
  redirect('/projects')
}
