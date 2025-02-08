import 'server-only'
//import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers'

export const auth = async ({
  cookieStore
}: {
  cookieStore: ReturnType<typeof cookies>
}) => {
  // Create a Supabase client configured to use cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            console.log(error)
          }
        },
      },
    }
  )
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}
