#!/bin/bash -e
#
############################################################

SERVER=spinoza.brightblock.org;
DOCKER_NAME=stxeco_api_vote

#DOCKER_ID_USER='mijoco'
#DOCKER_CMD='docker'

#$DOCKER_CMD build -t mijoco/stxeco_api_vote .
#$DOCKER_CMD tag mijoco/stxeco_api_vote mijoco/stxeco_api_vote
#$DOCKER_CMD push mijoco/stxeco_api_vote:latest

printf "\n\n===================================================="
printf "\nBuilding on: $SERVER as docker container: $DOCKER_NAME"

docker build
docker buildx build
docker build -t $DOCKER_NAME .
docker run -d -t -i --network host --env-file ~/.env --name $DOCKER_NAME -p 6060:6060 $DOCKER_NAME
docker logs -f txtxflow_api

#source ~/.profile;
#docker login;
##docker pull mijoco/stxeco_api_vote;
#docker rm -f stxeco_api_vote  
#docker run -d -t -i --network host --env-file ~/.env --name stxeco_api_vote -p 3010:3010 mijoco/stxeco_api_vote

printf "Finished....\n"
printf "\n-----------------------------------------------------------------------------------------------------\n";

exit 0;

