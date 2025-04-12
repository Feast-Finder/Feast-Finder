# Use official Node.js image
FROM node:18

# Set working directory
WORKDIR /repository

# Create a non-root user and group
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy package files and install dependencies before copying the rest
COPY package*.json ./

# Install dependencies with correct permissions
RUN npm install

# Copy the rest of the application code
COPY . .

# Set permissions for the app directory
RUN chown -R appuser:appuser /repository

# Switch to the new user
USER appuser

# Expose the port and start the app
EXPOSE 3000
CMD ["npm", "start"]
