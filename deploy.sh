#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

K8S_DIR="./k8s"

check_error() {
  if [ $? -ne 0 ]; then
    echo -e "${RED}Error during command execution. Stopping.${NC}"
    exit 1
  fi
}

check_kubectl() {
  if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}kubectl is not installed. Install it before proceeding.${NC}"
    exit 1
  fi
}

deploy_global() {
  echo -e "${YELLOW}Executing GLOBAL deployment...${NC}"
  
  echo -e "${GREEN}Deploying prometheus...${NC}"
  kubectl apply -f "$K8S_DIR/prometheus" && check_error

  echo -e "${GREEN}Deploying entrypoint...${NC}"
  kubectl apply -f "$K8S_DIR/entrypoint" && check_error
  
  echo -e "${GREEN}Deploying auth...${NC}"
  kubectl apply -f "$K8S_DIR/auth/auth.yaml" && check_error
  
  echo -e "${GREEN}Deploying gs-algorithm...${NC}"
  kubectl apply -f "$K8S_DIR/gs-algorithm" && check_error

  echo -e "${GREEN}Deploying persistence...${NC}"
  kubectl apply -f "$K8S_DIR/image/image.yaml" && check_error
  
  echo -e "${GREEN}Deploying persistence...${NC}"
  kubectl apply -f "$K8S_DIR/persistence/persistence.yaml" && check_error
  
  echo -e "${GREEN}Deploying recommender...${NC}"
  kubectl apply -f "$K8S_DIR/recommender/recommender.yaml" && check_error
  
  echo -e "${GREEN}Deploying webUI...${NC}"
  kubectl apply -f "$K8S_DIR/webUI/webUI.yaml" && check_error
  
  echo -e "${GREEN}Deployment completed successfully!${NC}"
}

deploy_local() {
  echo -e "${YELLOW}Executing LOCAL deployment...${NC}"

  echo -e "${GREEN}Deploying role...${NC}"
  kubectl apply -f "$K8S_DIR/roles" && check_error
  
  echo -e "${GREEN}Deploying prometheus...${NC}"
  kubectl apply -f "$K8S_DIR/prometheus" && check_error

  echo -e "${GREEN}Deploying entrypoint...${NC}"
  kubectl apply -f "$K8S_DIR/entrypoint" && check_error
  
  echo -e "${GREEN}Deploying auth...${NC}"
  kubectl apply -f "$K8S_DIR/auth" && check_error
  
  echo -e "${GREEN}Deploying persistence...${NC}"
  kubectl apply -f "$K8S_DIR/persistence" && check_error

  echo -e "${GREEN}Deploying persistence...${NC}"
  kubectl apply -f "$K8S_DIR/image" && check_error
  
  echo -e "${GREEN}Deploying recommender...${NC}"
  kubectl apply -f "$K8S_DIR/recommender" && check_error
  
  echo -e "${GREEN}Deploying webUI...${NC}"
  kubectl apply -f "$K8S_DIR/webUI" && check_error
  
  echo -e "${GREEN}Deployment completed successfully!${NC}"
}

deploy_services_only() {
  echo -e "${YELLOW}Executing SERVICES-ONLY deployment...${NC}"

  echo -e "${GREEN}Deploying prometheus...${NC}"
  kubectl apply -f "$K8S_DIR/prometheus" && check_error

  echo -e "${GREEN}Deploying entrypoint...${NC}"
  kubectl apply -f "$K8S_DIR/entrypoint" && check_error
  
  echo -e "${GREEN}Deploying auth...${NC}"
  kubectl apply -f "$K8S_DIR/auth/auth.yaml" && check_error
  
  echo -e "${GREEN}Deploying persistence...${NC}"
  kubectl apply -f "$K8S_DIR/persistence/persistence.yaml" && check_error
  
  echo -e "${GREEN}Deploying recommender...${NC}"
  kubectl apply -f "$K8S_DIR/recommender/recommender.yaml" && check_error

  echo -e "${GREEN}Deploying persistence...${NC}"
  kubectl apply -f "$K8S_DIR/image/image.yaml" && check_error
  
  echo -e "${GREEN}Deploying webUI...${NC}"
  kubectl apply -f "$K8S_DIR/webUI/webUI.yaml" && check_error
  
  echo -e "${GREEN}Services-only deployment completed successfully!${NC}"
}

undeploy_all() {
  echo -e "${YELLOW}Undeploying all components...${NC}"

  echo -e "${GREEN}Removing entrypoint...${NC}"
  kubectl delete -f "$K8S_DIR/entrypoint" --ignore-not-found=true
  
  echo -e "${GREEN}Removing webUI...${NC}"
  kubectl delete -f "$K8S_DIR/webUI" --ignore-not-found=true
  kubectl delete -f "$K8S_DIR/webUI/webUI.yaml" --ignore-not-found=true
  
  echo -e "${GREEN}Removing recommender...${NC}"
  kubectl delete -f "$K8S_DIR/recommender" --ignore-not-found=true
  kubectl delete -f "$K8S_DIR/recommender/recommender.yaml" --ignore-not-found=true
  
  echo -e "${GREEN}Removing persistence...${NC}"
  kubectl delete -f "$K8S_DIR/persistence" --ignore-not-found=true
  kubectl delete -f "$K8S_DIR/persistence/persistence.yaml" --ignore-not-found=true
  
  echo -e "${GREEN}Removing gs-algorithm...${NC}"
  kubectl delete -f "$K8S_DIR/gs-algorithm" --ignore-not-found=true
  
  echo -e "${GREEN}Removing auth...${NC}"
  kubectl delete -f "$K8S_DIR/auth" --ignore-not-found=true
  kubectl delete -f "$K8S_DIR/auth/auth.yaml" --ignore-not-found=true

  echo -e "${GREEN}Removing auth...${NC}"
  kubectl delete -f "$K8S_DIR/image" --ignore-not-found=true
  kubectl delete -f "$K8S_DIR/image/image.yaml" --ignore-not-found=true
  
  echo -e "${GREEN}Removing prometheus...${NC}"
  kubectl delete -f "$K8S_DIR/prometheus" --ignore-not-found=true
  
  echo -e "${GREEN}All components successfully removed!${NC}"
}

main() {
  check_kubectl
  
  if [ $# -ne 1 ]; then
    echo -e "${RED}Provide one argument: 'global', 'local', 'services', or 'undeploy'${NC}"
    echo "Example: $0 global"
    exit 1
  fi

  case "$1" in
    "global")
      deploy_global
      ;;
    "local")
      deploy_local
      ;;
    "services")
      deploy_services_only
      ;;
    "undeploy")
      undeploy_all
      ;;
    *)
      echo -e "${RED}Invalid argument. Use 'global', 'local', 'services', or 'undeploy'${NC}"
      echo "Example: $0 global"
      exit 1
      ;;
  esac
}

main "$@"