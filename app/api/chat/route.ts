import 'server-only'
import { OpenAIStream, StreamingTextResponse } from 'ai'
import { Configuration, OpenAIApi} from 'openai-edge'
//import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/lib/db_types'

import { auth } from '@/auth'
import { nanoid } from '@/lib/utils'

export const runtime = 'edge'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})

const tools = [
  {
    name: "getCurrentTime",
    description: "Returns the current server time.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

// Function implementation
function getCurrentTime() {
  return new Date().toISOString();
}

const openai = new OpenAIApi(configuration)

export async function POST(req: Request) {
  const cookieStore = cookies()
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
            console.log("error in chat")
            console.log(error)
          }
        },
      },
    }
  )
  const json = await req.json()
  const { messages, previewToken } = json
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', {
      status: 401
    })
  }
  //const userId = (await auth({ cookieStore }))?.user.id
  const userId = user.id

  //if (!userId) {
  //  return new Response('Unauthorized', {
  //    status: 401
  //  })
  //}

  if (previewToken) {
    configuration.apiKey = previewToken
  }

  const res = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages,
    temperature: 0.7,
    stream: true,
    functions: tools,
    function_call: "auto",
  })

  //const data = await res.json();
  //const { function_call } = data.choices[0].message;

  //if (function_call) {
  //  const { name, arguments: args } = function_call;

  //  if (name === "getCurrentTime") {
  //    // Call your function and handle the response
  //    const result = { currentTime: new Date().toISOString() };

  //    // Log or return the function result
  //    console.log(result);
  //    return result;
  //  }
  //}

  const stream = OpenAIStream(res, {
    async onCompletion(completion) {
      const title = json.messages[0].content.substring(0, 100)
      const id = json.id ?? nanoid()
      const createdAt = Date.now()
      const path = `/chat/${id}`
      const payload = {
        id,
        title,
        userId,
        createdAt,
        path,
        messages: [
          ...messages,
          {
            content: completion,
            role: 'assistant'
          }
        ]
      }
      // Insert chat into database.
      await supabase.from('chats').upsert({ id, payload }).throwOnError()
    }
  })

  return new StreamingTextResponse(stream)
}
