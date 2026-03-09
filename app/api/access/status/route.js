import { NextResponse } from "next/server";

export async function GET(req){

  try{
    const accessCookie = req.cookies.get("demo_access")?.value;

    return NextResponse.json(
      {
        ok:true,
        hasAccess: accessCookie === "granted"
      },
      {status: 200}
    )

  }catch(error){
    return NextResponse.json(
      {
        ok: false,
        hasAccess: false
      },
      {status: 500}
    )

  }

}