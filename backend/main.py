from fastapi import FastAPI, Form, Request, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fpdf import FPDF
import openai
from dotenv import load_dotenv
import os
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from bs4 import BeautifulSoup
from lxml import etree
import urllib.parse
import re
import time
load_dotenv()

openai.api_key = os.getenv("OPENAI_API_SECRET_KEY")
allowed_origins = os.getenv("ALLOWED_ORIGINS")
openai_model = os.getenv("OPENAI_MODEL")


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

conversation_history = {}



class MessageRequest(BaseModel):
    conversation: list


def generate_response_stream(conversation: list):
    response = openai.chat.completions.create(
        model=openai_model,
        messages=conversation,
        stream=True  
    )

    for chunk in response:
       
            
        chunk_message = chunk.choices[0].delta.content
        if chunk_message:
            
            yield chunk_message

@app.get("/ping/")
async def ping():
    return {"message": "pong"}

@app.post("/chat/")
async def ai_stream(request: MessageRequest):
    conversation = request.conversation
    return StreamingResponse(generate_response_stream(conversation), media_type="text/plain")

class SearchRequest(BaseModel):
    query: str

def clean_query(query: str) -> str:
    query = re.sub(r'[^\w\s]', '', query)
    query = re.sub(r'\s+', ' ', query)
    return query.strip()

@app.post("/search/")
async def search_duckduckgo(request: SearchRequest):
    query = request.query
    cleaned_query = clean_query(query)
    

  

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0"
    }

    encoded_query = urllib.parse.quote(cleaned_query)
    
    search_url = f"https://www.bing.com/search?q={encoded_query}"
   
    

    response = requests.get(search_url, headers=headers, timeout=10)


    soup = BeautifulSoup(response.text, 'html.parser')
     
  
        
    list_items = soup.find_all('li', class_='b_algo')

  
    html_results = ""
   
    for item in list_items:
       
        a_tag = item.find('h2').find('a')
        title = a_tag.get_text()
        url = a_tag.get('href')

        html_results += f'<h4>{title} - </h4>  <a href="{url}" target="_blank">{url}</a><br><br>'
    return {"html": html_results}
    
    

from datetime import datetime

explanation_styles = {"For Newbies": "Explain to me like I'm 5. Use simple words and examples.", 
                        "Intermediate ": "Give me concise explanations. I'm already familiar with the topic." ,
                         "Detailed": "Give me detailed explanations. I'm already familiar with the topic."}

lengths = {"short": "Give me a short explanation. It is mandatory to be less than 100 words.", 
            "medium": "Give me a medium explanation. It is mandatory to be more than 100 words and less than 500 words.", 
            "long": "Give me a long explanation. It is mandatory to be more than 500 words."}

class SummarizeRequest(BaseModel):
    text: str
    language: str
    style: str
    length: str

@app.post("/summarize/")
async def summarize(request: SummarizeRequest): 
   
    user_input = request.text
    
    language = request.language
    style = explanation_styles.get(request.style, "Give me concise explanations.")
    length = lengths.get(request.length, "Give me medium length explanation.")
   
    try:
        response = openai.chat.completions.create(
            model=openai_model,
            messages=[
                    {"role": "system", "content": f"You are a helpful assistant that explain and summarizes text in {language}."},
                    {"role": "user", "content": style + length + user_input}
                ],
            temperature=0.7
        )
        bot_response = response.choices[0].message.content
        return {"summary": bot_response}

        
    except Exception as e:
        return {"error": str(e)}
